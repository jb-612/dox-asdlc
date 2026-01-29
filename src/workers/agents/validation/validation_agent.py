"""ValidationAgent for E2E testing and validation report generation.

RLM-enabled validation agent that runs E2E tests, checks integration points,
and generates validation reports. Uses RLM for complex scenarios including
intermittent failures, performance regression, and integration issues.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import TYPE_CHECKING, Any

from src.workers.agents.development.models import TestRunResult
from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.validation.config import ValidationConfig
from src.workers.agents.validation.models import (
    CheckCategory,
    ValidationCheck,
    ValidationReport,
)

if TYPE_CHECKING:
    from src.workers.artifacts.writer import ArtifactWriter
    from src.workers.llm.client import LLMClient
    from src.workers.rlm.integration import RLMIntegration
    from src.workers.agents.development.test_runner import TestRunner

logger = logging.getLogger(__name__)


class ValidationAgentError(Exception):
    """Raised when ValidationAgent operations fail."""

    pass


class ValidationAgent:
    """Agent that runs E2E tests and generates validation reports.

    Implements the BaseAgent protocol to be dispatched by the worker pool.
    Uses RLM for complex validation scenarios including intermittent failures,
    performance regression, and integration issues.

    Example:
        agent = ValidationAgent(
            llm_client=client,
            artifact_writer=writer,
            test_runner=runner,
            config=ValidationConfig(),
            rlm_integration=rlm,
        )
        result = await agent.execute(context, event_metadata)
    """

    def __init__(
        self,
        llm_client: LLMClient,
        artifact_writer: ArtifactWriter,
        test_runner: TestRunner,
        config: ValidationConfig,
        rlm_integration: RLMIntegration | None = None,
    ) -> None:
        """Initialize the ValidationAgent.

        Args:
            llm_client: LLM client for validation analysis.
            artifact_writer: Writer for persisting artifacts.
            test_runner: Test runner for executing E2E tests.
            config: Validation configuration.
            rlm_integration: Optional RLM integration for complex scenarios.
        """
        self._llm_client = llm_client
        self._artifact_writer = artifact_writer
        self._test_runner = test_runner
        self._config = config
        self._rlm_integration = rlm_integration

    @property
    def agent_type(self) -> str:
        """Return the agent type identifier."""
        return "validation_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        """Execute validation for implementation code.

        Args:
            context: Execution context with session/task info.
            event_metadata: Additional metadata from triggering event.
                Expected keys:
                - implementation: The implementation to validate (required)
                - acceptance_criteria: List of acceptance criteria (required)
                - test_path: Path to E2E tests (optional, uses default)
                - feature_id: Feature identifier for the report

        Returns:
            AgentResult: Result with validation report artifacts on success.
        """
        logger.info(f"ValidationAgent starting for task {context.task_id}")

        try:
            # Validate required inputs
            implementation = event_metadata.get("implementation")
            if not implementation:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No implementation provided in event_metadata",
                    should_retry=False,
                )

            acceptance_criteria = event_metadata.get("acceptance_criteria", [])
            if not acceptance_criteria:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No acceptance_criteria provided in event_metadata",
                    should_retry=False,
                )

            # Extract optional metadata
            test_path = event_metadata.get("test_path", "tests/e2e")
            feature_id = event_metadata.get("feature_id", context.task_id)

            # Run E2E tests
            e2e_results = await self._run_e2e_tests(
                test_path=test_path,
                context=context,
            )

            # Check if RLM should be used for complex validation
            used_rlm = False
            rlm_context = ""
            rlm_error = None

            if (
                self._config.enable_rlm
                and self._rlm_integration
                and self._needs_rlm_validation(e2e_results)
            ):
                used_rlm = True
                rlm_result = await self._run_rlm_exploration(
                    e2e_results=e2e_results,
                    implementation=implementation,
                    context=context,
                )
                if rlm_result:
                    rlm_context = rlm_result.get("formatted_output", "")
                    if rlm_result.get("error"):
                        rlm_error = rlm_result.get("error")

            # Generate validation report using LLM
            validation_report = await self._generate_validation_report(
                implementation=implementation,
                acceptance_criteria=acceptance_criteria,
                e2e_results=e2e_results,
                rlm_context=rlm_context,
                feature_id=feature_id,
            )

            if not validation_report:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to generate validation report",
                    should_retry=True,
                )

            # Write artifacts
            artifact_paths = await self._write_artifacts(context, validation_report)

            # Determine success based on validation result
            success = validation_report.passed

            logger.info(
                f"ValidationAgent completed for task {context.task_id}, "
                f"passed: {success}, checks: {len(validation_report.checks)}"
            )

            metadata: dict[str, Any] = {
                "validation_report": validation_report.to_dict(),
                "used_rlm": used_rlm,
            }

            # Set next agent if validation passed
            if success:
                metadata["next_agent"] = "security_agent"
            else:
                metadata["next_agent"] = None

            if rlm_error:
                metadata["rlm_error"] = rlm_error

            return AgentResult(
                success=success,
                agent_type=self.agent_type,
                task_id=context.task_id,
                artifact_paths=artifact_paths,
                metadata=metadata,
            )

        except Exception as e:
            logger.error(f"ValidationAgent failed: {e}", exc_info=True)
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message=str(e),
                should_retry=True,
            )

    async def _run_e2e_tests(
        self,
        test_path: str,
        context: AgentContext,
    ) -> TestRunResult:
        """Run E2E tests using the test runner.

        Args:
            test_path: Path to E2E tests.
            context: Agent context.

        Returns:
            TestRunResult: Results of the E2E test run.
        """
        test_path_obj = Path(context.workspace_path) / test_path

        # Configure timeout from config
        self._test_runner.timeout_seconds = self._config.e2e_test_timeout

        return self._test_runner.run_tests(
            test_path=test_path_obj,
            with_coverage=True,
            suite_id=f"{context.task_id}-e2e",
        )

    def _needs_rlm_validation(self, e2e_results: TestRunResult) -> bool:
        """Determine if RLM should be used for validation.

        RLM is triggered for:
        - Intermittent failures (flaky tests)
        - Performance regression
        - Integration issues with external systems

        Args:
            e2e_results: E2E test results.

        Returns:
            bool: True if RLM should be used.
        """
        # Check for intermittent failures (flaky tests)
        metadata = e2e_results.metadata or {}
        run_count = metadata.get("run_count", 1)
        pass_count = metadata.get("pass_count", 0)

        # If test was run multiple times with mixed results, it's intermittent
        if run_count > 1 and 0 < pass_count < run_count:
            return True

        # Check for performance regression
        if metadata.get("performance_regression"):
            return True

        # Check for integration failures
        if metadata.get("integration_failure"):
            return True

        # Check for specific error types in results
        for result in e2e_results.results:
            if not result.passed and result.error:
                error_lower = result.error.lower()
                # Timeout/connection issues suggest intermittent problems
                if any(term in error_lower for term in [
                    "timeout", "connection", "intermittent",
                    "integration", "external", "service"
                ]):
                    return True
                # Performance issues
                if any(term in error_lower for term in [
                    "performance", "slow", "threshold", "latency"
                ]):
                    return True

        return False

    async def _run_rlm_exploration(
        self,
        e2e_results: TestRunResult,
        implementation: dict[str, Any],
        context: AgentContext,
    ) -> dict[str, Any] | None:
        """Run RLM exploration for complex validation scenarios.

        Args:
            e2e_results: E2E test results.
            implementation: Implementation code being validated.
            context: Agent context.

        Returns:
            dict | None: RLM exploration results or None.
        """
        if not self._rlm_integration:
            return None

        try:
            # Build exploration query based on failure patterns
            failure_summary = self._summarize_failures(e2e_results)

            query = f"""
Analyze these E2E test failures and find relevant context in the codebase:

Test Failures:
{failure_summary}

Look for:
1. Similar code patterns that handle these scenarios correctly
2. Service dependencies and their expected behavior
3. Integration patterns with external systems
4. Retry/resilience patterns for transient failures
5. Performance optimization patterns
"""

            # Build context hints
            context_hints = self._build_context_hints(context)

            result = await self._rlm_integration.explore(
                query=query,
                context_hints=context_hints,
                task_id=context.task_id,
            )

            return {
                "formatted_output": result.formatted_output,
                "error": result.error,
            }

        except Exception as e:
            logger.warning(f"RLM exploration failed: {e}")
            return {
                "formatted_output": "",
                "error": str(e),
            }

    def _summarize_failures(self, e2e_results: TestRunResult) -> str:
        """Summarize test failures for RLM query.

        Args:
            e2e_results: E2E test results.

        Returns:
            str: Summary of failures.
        """
        lines = []
        for result in e2e_results.results:
            if not result.passed:
                lines.append(f"- {result.test_id}: {result.error or 'Unknown error'}")
        return "\n".join(lines) if lines else "No specific failures recorded"

    def _build_context_hints(self, context: AgentContext) -> list[str]:
        """Build context hints from context pack.

        Args:
            context: Agent context with optional context pack.

        Returns:
            list[str]: Context hints for RLM exploration.
        """
        hints = []

        if not context.context_pack:
            return hints

        files = context.context_pack.get("files", [])
        for file_info in files[:5]:
            path = file_info.get("path", "")
            if path:
                hints.append(f"Related file: {path}")

        interfaces = context.context_pack.get("interfaces", [])
        if interfaces:
            hints.append(f"Relevant interfaces: {', '.join(interfaces)}")

        return hints

    async def _generate_validation_report(
        self,
        implementation: dict[str, Any],
        acceptance_criteria: list[str],
        e2e_results: TestRunResult,
        rlm_context: str,
        feature_id: str,
    ) -> ValidationReport | None:
        """Generate validation report using LLM.

        Args:
            implementation: Implementation being validated.
            acceptance_criteria: Acceptance criteria to validate.
            e2e_results: E2E test results.
            rlm_context: Context from RLM exploration.
            feature_id: Feature identifier.

        Returns:
            ValidationReport | None: Generated report or None if failed.
        """
        # Build prompt for validation analysis
        prompt = self._format_validation_prompt(
            implementation=implementation,
            acceptance_criteria=acceptance_criteria,
            e2e_results=e2e_results,
            rlm_context=rlm_context,
        )

        try:
            response = await self._llm_client.generate(
                prompt=prompt,
                max_tokens=self._config.max_tokens,
                temperature=self._config.temperature,
            )

            # Parse response
            analysis_data = self._parse_json_from_response(response.content)

            if not analysis_data:
                logger.warning("Invalid validation analysis response - no valid JSON")
                return None

            # Build validation checks
            checks = []
            for check_data in analysis_data.get("checks", []):
                try:
                    check = ValidationCheck(
                        name=check_data.get("name", ""),
                        category=CheckCategory(check_data.get("category", "functional")),
                        passed=check_data.get("passed", False),
                        details=check_data.get("details", ""),
                        evidence=check_data.get("evidence"),
                    )
                    checks.append(check)
                except (ValueError, KeyError) as e:
                    logger.warning(f"Skipping invalid validation check: {e}")
                    continue

            # Determine overall pass/fail
            # All checks must pass AND E2E tests must pass
            all_checks_passed = all(check.passed for check in checks) if checks else True
            e2e_passed = e2e_results.all_passed()
            overall_passed = all_checks_passed and e2e_passed

            return ValidationReport(
                feature_id=feature_id,
                checks=checks,
                e2e_results=e2e_results,
                passed=overall_passed,
                recommendations=analysis_data.get("recommendations", []),
            )

        except Exception as e:
            logger.error(f"Validation report generation failed: {e}")
            raise

    def _format_validation_prompt(
        self,
        implementation: dict[str, Any],
        acceptance_criteria: list[str],
        e2e_results: TestRunResult,
        rlm_context: str,
    ) -> str:
        """Format prompt for validation analysis.

        Args:
            implementation: Implementation being validated.
            acceptance_criteria: Acceptance criteria.
            e2e_results: E2E test results.
            rlm_context: Context from RLM exploration.

        Returns:
            str: Formatted prompt.
        """
        # Summarize implementation files
        impl_summary = ""
        files = implementation.get("files", [])
        for file_info in files[:5]:
            path = file_info.get("path", "unknown")
            content = file_info.get("content", "")
            impl_summary += f"\n### {path}\n```\n{content[:1000]}...\n```\n"

        # Format acceptance criteria
        criteria_list = "\n".join(f"- {c}" for c in acceptance_criteria)

        # Format E2E results
        e2e_summary = f"""
E2E Test Results:
- Passed: {e2e_results.passed}
- Failed: {e2e_results.failed}
- Coverage: {e2e_results.coverage}%

Test Details:
"""
        for result in e2e_results.results[:10]:  # Limit to 10 results
            status = "PASS" if result.passed else "FAIL"
            e2e_summary += f"- {result.test_id}: {status}"
            if result.error:
                e2e_summary += f" - {result.error[:200]}"
            e2e_summary += "\n"

        prompt = f"""Analyze this implementation against the acceptance criteria and E2E test results.

## Implementation
{impl_summary}

## Acceptance Criteria
{criteria_list}

## E2E Test Results
{e2e_summary}
"""

        if rlm_context:
            prompt += f"""
## Additional Context from RLM Analysis
{rlm_context}
"""

        prompt += """
## Output Format

Respond with a JSON object containing:
```json
{
    "checks": [
        {
            "name": "Check name",
            "category": "functional|performance|compatibility",
            "passed": true,
            "details": "Detailed description of the check result",
            "evidence": "Reference to evidence file or null"
        }
    ],
    "recommendations": ["List of recommendations for improvement"]
}
```

Include checks for:
1. E2E test coverage of acceptance criteria
2. Integration point verification
3. Performance baseline compliance (if applicable)
4. Compatibility requirements (if applicable)
"""

        return prompt

    def _parse_json_from_response(self, content: str) -> dict[str, Any] | None:
        """Parse JSON from LLM response, handling code blocks.

        Args:
            content: Raw LLM response content.

        Returns:
            dict | None: Parsed JSON or None if parsing fails.
        """
        # Try direct JSON parse first
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # Try extracting from code blocks
        patterns = [
            r'```json\s*\n?(.*?)\n?```',
            r'```\s*\n?(.*?)\n?```',
        ]

        for pattern in patterns:
            match = re.search(pattern, content, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(1).strip())
                except json.JSONDecodeError:
                    continue

        # Try finding JSON-like content
        json_start = content.find('{')
        json_end = content.rfind('}')
        if json_start != -1 and json_end != -1 and json_end > json_start:
            try:
                return json.loads(content[json_start:json_end + 1])
            except json.JSONDecodeError:
                pass

        return None

    async def _write_artifacts(
        self,
        context: AgentContext,
        validation_report: ValidationReport,
    ) -> list[str]:
        """Write validation report artifacts.

        Args:
            context: Agent context.
            validation_report: Generated validation report.

        Returns:
            list[str]: Paths to written artifacts.
        """
        from src.workers.artifacts.writer import ArtifactType

        paths = []

        # Write JSON artifact (structured data)
        json_content = validation_report.to_json()
        json_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=json_content,
            artifact_type=ArtifactType.REPORT,
            filename=f"{context.task_id}_validation_report.json",
        )
        paths.append(json_path)

        # Write Markdown artifact (human-readable)
        markdown_content = validation_report.to_markdown()
        markdown_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=markdown_content,
            artifact_type=ArtifactType.REPORT,
            filename=f"{context.task_id}_validation_report.md",
        )
        paths.append(markdown_path)

        return paths

    def validate_context(self, context: AgentContext) -> bool:
        """Validate that context is suitable for execution.

        Args:
            context: Agent context to validate.

        Returns:
            bool: True if context is valid.
        """
        return bool(
            context.session_id
            and context.task_id
            and context.workspace_path
        )
